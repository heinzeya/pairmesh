defmodule PairMesh do
  @moduledoc """
  Public entry point for PairMesh.

  Every pairing is bound to one plugin, which decides the commands its
  participants may send:

      PairMesh.create_pairing(context, plugin: "presentation")
      PairMesh.create_pairing(context, plugin: "gamepad")
  """

  alias PairMesh.Pairings

  @doc """
  Creates a short-lived pairing owned by `context.device_id` for `:plugin`.

  Returns `{:ok, session, secret}`, where the secret is shown once (e.g. in a
  QR code) and is needed to claim the pairing. Returns
  `{:error, :unknown_plugin}` when the plugin is missing or not enabled.
  """
  @spec create_pairing(%{required(:device_id) => String.t()}, keyword()) ::
          {:ok, PairMesh.Pairing.Session.t(), String.t()} | {:error, :unknown_plugin}
  def create_pairing(%{device_id: owner}, opts) when is_binary(owner) and is_list(opts) do
    Pairings.create(owner, Keyword.get(opts, :plugin))
  end
end
