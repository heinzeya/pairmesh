defmodule PairMesh.PairingsTest do
  use ExUnit.Case, async: true

  alias PairMesh.Pairings

  defp unique_device, do: "device-#{System.unique_integer([:positive])}"

  test "member? covers the owner and a claimed or approved claimant" do
    owner = unique_device()
    claimant = unique_device()
    {:ok, session, secret} = Pairings.create(owner, "presentation")

    assert Pairings.member?(session.id, owner)
    refute Pairings.member?(session.id, claimant)

    {:ok, _} = Pairings.claim(session.id, claimant, secret)
    assert Pairings.member?(session.id, claimant)
    refute Pairings.participant?(session.id, claimant)

    {:ok, _} = Pairings.approve(session.id, owner)
    assert Pairings.member?(session.id, claimant)
    assert Pairings.participant?(session.id, claimant)

    refute Pairings.member?(session.id, unique_device())
    refute Pairings.member?("unknown", owner)
  end
end
