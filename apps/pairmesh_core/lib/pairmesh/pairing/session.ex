defmodule PairMesh.Pairing.Session do
  @moduledoc "Represents a temporary device pairing request, bound to one plugin id."

  @enforce_keys [:id, :owner, :plugin, :secret_hash, :expires_at]

  @type t :: %__MODULE__{}

  defstruct [
    :id,
    :owner,
    :plugin,
    :secret_hash,
    :expires_at,
    :claimant,
    status: :pending
  ]
end
