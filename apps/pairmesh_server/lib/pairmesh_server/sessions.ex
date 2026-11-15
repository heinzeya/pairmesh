defmodule PairmeshServer.Sessions do
  @moduledoc """
  The pairing flow behind `PairmeshServerWeb.SessionChannel` (see
  `docs/protocol.md`).

  Every event is broadcast on the `"session:<pairing_id>"` topic, so all
  devices in a pairing see the same messages:

    * `"pairing.requested"` - a device claimed the pairing (`"device_id"`)
    * `"pairing.approved"` - the owner approved the claimant (`"device_id"`)
    * plugin events such as `"slide.next"` - sent by an approved participant
      (`"plugin"`, `"device_id"`, plus any fields the plugin returns). Only
      commands of the plugin the pairing was created for are accepted.
  """

  alias PairMesh.{Pairings, Plugins}
  alias PairmeshServerWeb.Endpoint

  def topic(pairing_id), do: "session:" <> pairing_id

  @doc "Subscribes the caller to a pairing's events as `%Phoenix.Socket.Broadcast{}` messages."
  def subscribe(pairing_id), do: Endpoint.subscribe(topic(pairing_id))

  def broadcast(pairing_id, event, payload) do
    Endpoint.broadcast(topic(pairing_id), event, payload)
  end

  @doc """
  `pairing.create` for `plugin_id` (e.g. `"presentation"` or `"gamepad"`).
  Returns `{:ok, session, secret}`; the secret goes into the QR code.
  """
  def create(owner, plugin_id),
    do: PairMesh.create_pairing(%{device_id: owner}, plugin: plugin_id)

  @doc "`pairing.claim`: claims the pairing and notifies the owner with `pairing.requested`."
  def claim(pairing_id, device, secret) when is_binary(secret) do
    with {:ok, session} <- Pairings.claim(pairing_id, device, secret) do
      broadcast(pairing_id, "pairing.requested", %{"device_id" => device})
      {:ok, session}
    end
  end

  def claim(_pairing_id, _device, _secret), do: {:error, :invalid_pairing}

  @doc "`pairing.approve`: only the owner may approve; broadcasts `pairing.approved`."
  def approve(pairing_id, owner) do
    with {:ok, session} <- Pairings.approve(pairing_id, owner) do
      broadcast(pairing_id, "pairing.approved", %{"device_id" => session.claimant})
      {:ok, session}
    end
  end

  @doc """
  Runs a command (e.g. `"slide.next"`) of the pairing's plugin for an approved
  participant and broadcasts the resulting event under the plugin's event name.
  Commands of other plugins return `{:error, :forbidden}`.
  """
  def command(pairing_id, device, command, payload \\ %{}) do
    context = %{pairing_id: pairing_id, device_id: device}

    with :ok <- require_participant(pairing_id, device),
         {:ok, %{plugin: plugin_id}} <- Pairings.get(pairing_id),
         {:ok, event} <- Plugins.dispatch(plugin_id, command, payload, context) do
      {name, fields} = Map.pop(event, :event, command)

      broadcast(
        pairing_id,
        name,
        fields
        |> Map.new(fn {k, v} -> {to_string(k), v} end)
        |> Map.merge(%{"plugin" => plugin_id, "device_id" => device})
      )

      {:ok, event}
    end
  end

  defp require_participant(pairing_id, device) do
    if Pairings.participant?(pairing_id, device), do: :ok, else: {:error, :not_approved}
  end
end
