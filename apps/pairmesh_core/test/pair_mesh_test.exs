defmodule PairMeshTest do
  use ExUnit.Case, async: true

  alias PairMesh.Pairing.Session

  defp context, do: %{device_id: "device-#{System.unique_integer([:positive])}"}

  test "create_pairing binds the pairing to the given plugin" do
    context = context()

    assert {:ok, %Session{plugin: "presentation", owner: owner}, secret} =
             PairMesh.create_pairing(context, plugin: "presentation")

    assert owner == context.device_id
    assert is_binary(secret)

    assert {:ok, %Session{plugin: "gamepad"}, _secret} =
             PairMesh.create_pairing(context, plugin: "gamepad")
  end

  test "create_pairing rejects missing or unknown plugins" do
    assert {:error, :unknown_plugin} = PairMesh.create_pairing(context(), [])
    assert {:error, :unknown_plugin} = PairMesh.create_pairing(context(), plugin: "nope")
  end
end
