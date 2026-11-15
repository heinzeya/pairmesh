defmodule PairmeshServerWeb.SessionChannel do
  @moduledoc """
  Socket API for the pairing flow (see `PairmeshServer.Sessions`).

    * Laptop joins `"session:lobby"` and pushes `"pairing.create"` with
      `%{"plugin" => "presentation" | "gamepad"}`. The reply holds
      `pairing_id` and `secret` to put in the QR code. It then joins
      `"session:<pairing_id>"`.
    * Phone joins `"session:<pairing_id>"` with `%{"secret" => secret}`. This
      is `pairing.claim`; the laptop receives `"pairing.requested"`. Joins
      reply with the pairing's `status`, `plugin` and the device's `role`.
    * Laptop pushes `"pairing.approve"`; both receive `"pairing.approved"`.
    * Either device pushes a command of the pairing's plugin such as
      `"slide.next"`; both receive the resulting event.
  """
  use PairmeshServerWeb, :channel

  alias PairMesh.Pairings
  alias PairmeshServer.Sessions

  @impl true
  def join("session:lobby", _payload, socket), do: {:ok, socket}

  def join("session:" <> pairing_id, payload, socket) do
    device = socket.assigns.device_id

    # Members (including a reconnecting claimant) rejoin without re-claiming.
    authorized =
      Pairings.member?(pairing_id, device) or
        match?({:ok, _}, Sessions.claim(pairing_id, device, payload["secret"]))

    with true <- authorized,
         {:ok, session} <- Pairings.get(pairing_id) do
      {:ok, join_reply(session, device), assign(socket, :pairing_id, pairing_id)}
    else
      _ -> {:error, %{reason: "unauthorized"}}
    end
  end

  # Lets a (re)joining device know where the pairing stands, e.g. a phone that
  # reloads after approval gets "approved" without waiting for a broadcast.
  defp join_reply(session, device) do
    %{
      status: to_string(session.status),
      plugin: session.plugin,
      role: if(session.owner == device, do: "owner", else: "claimant")
    }
  end

  @impl true
  def handle_in("pairing.create", payload, %{topic: "session:lobby"} = socket) do
    case Sessions.create(socket.assigns.device_id, payload["plugin"]) do
      {:ok, session, secret} ->
        {:reply,
         {:ok,
          %{
            pairing_id: session.id,
            secret: secret,
            plugin: session.plugin,
            expires_at: session.expires_at
          }}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in(_event, _payload, %{topic: "session:lobby"} = socket) do
    {:reply, {:error, %{reason: "unknown_event"}}, socket}
  end

  def handle_in("ping", payload, socket) do
    {:reply, {:ok, payload}, socket}
  end

  def handle_in("pairing.approve", _payload, socket) do
    case Sessions.approve(socket.assigns.pairing_id, socket.assigns.device_id) do
      {:ok, _session} -> {:reply, :ok, socket}
      {:error, _} -> {:reply, {:error, %{reason: "not_allowed"}}, socket}
    end
  end

  # Relays a message to every other participant in the pairing.
  def handle_in("relay", payload, socket) do
    if Pairings.participant?(socket.assigns.pairing_id, socket.assigns.device_id) do
      broadcast_from!(socket, "relay", payload)
      {:noreply, socket}
    else
      {:reply, {:error, %{reason: "not_approved"}}, socket}
    end
  end

  # Anything else is a plugin command, e.g. "slide.next".
  def handle_in(command, payload, socket) do
    %{pairing_id: pairing_id, device_id: device} = socket.assigns

    case Sessions.command(pairing_id, device, command, payload) do
      {:ok, event} -> {:reply, {:ok, event}, socket}
      {:error, reason} -> {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end
end
