defmodule PairMesh.Plugins.Gamepad do
  @moduledoc """
  Turns a paired phone into a gamepad.

  Commands:

    * `"gamepad.button.down"` / `"gamepad.button.up"` with
      `%{"button" => button}`, where `button` is one of `buttons/0`
    * `"gamepad.stick"` with `%{"stick" => "left" | "right", "x" => x, "y" => y}`,
      where `x` and `y` are numbers clamped to `-1.0..1.0`
  """
  @behaviour PairMesh.Plugin

  @buttons ~w(a b x y up down left right start select l r)
  @sticks ~w(left right)

  @doc "The buttons a gamepad command may name."
  def buttons, do: @buttons

  @impl true
  def id, do: "gamepad"

  @impl true
  def permissions do
    ["gamepad.button.down", "gamepad.button.up", "gamepad.stick"]
  end

  @impl true
  def handle_command(command, %{"button" => button}, _context)
      when command in ["gamepad.button.down", "gamepad.button.up"] and button in @buttons do
    {:ok, %{event: command, button: button}}
  end

  def handle_command("gamepad.stick", %{"stick" => stick, "x" => x, "y" => y}, _context)
      when stick in @sticks and is_number(x) and is_number(y) do
    {:ok, %{event: "gamepad.stick", stick: stick, x: clamp(x), y: clamp(y)}}
  end

  def handle_command(command, _payload, _context) do
    if command in permissions(), do: {:error, :invalid_payload}, else: {:error, :unsupported_command}
  end

  defp clamp(value), do: value |> max(-1.0) |> min(1.0) |> Kernel.*(1.0)
end
