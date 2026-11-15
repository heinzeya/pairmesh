defmodule PairMesh.Plugins.GamepadTest do
  use ExUnit.Case, async: true

  alias PairMesh.Plugins

  test "gamepad plugin is registered" do
    assert {:ok, PairMesh.Plugins.Gamepad} = Plugins.fetch("gamepad")
  end

  test "button presses and releases" do
    assert {:ok, %{event: "gamepad.button.down", button: "a"}} =
             Plugins.dispatch("gamepad", "gamepad.button.down", %{"button" => "a"})

    assert {:ok, %{event: "gamepad.button.up", button: "start"}} =
             Plugins.dispatch("gamepad", "gamepad.button.up", %{"button" => "start"})
  end

  test "stick values are clamped to -1.0..1.0" do
    assert {:ok, %{event: "gamepad.stick", stick: "right", x: 1.0, y: -1.0}} =
             Plugins.dispatch("gamepad", "gamepad.stick", %{
               "stick" => "right",
               "x" => 5,
               "y" => -3
             })

    assert {:ok, %{x: 0.25, y: +0.0}} =
             Plugins.dispatch("gamepad", "gamepad.stick", %{
               "stick" => "left",
               "x" => 0.25,
               "y" => 0
             })
  end

  test "invalid payloads are rejected" do
    assert {:error, :invalid_payload} =
             Plugins.dispatch("gamepad", "gamepad.button.down", %{"button" => "turbo"})

    assert {:error, :invalid_payload} = Plugins.dispatch("gamepad", "gamepad.button.up", %{})

    assert {:error, :invalid_payload} =
             Plugins.dispatch("gamepad", "gamepad.stick", %{
               "stick" => "left",
               "x" => "1",
               "y" => 0
             })

    assert {:error, :invalid_payload} =
             Plugins.dispatch("gamepad", "gamepad.stick", %{
               "stick" => "middle",
               "x" => 0,
               "y" => 0
             })
  end

  test "commands outside its permissions are forbidden" do
    assert {:error, :forbidden} = Plugins.dispatch("gamepad", "slide.next")
  end
end
