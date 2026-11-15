defmodule PairMesh.Plugins.Presentation do
  @moduledoc """
  Turns a paired phone into a presentation remote.

  Commands:

    * `"slide.next"` / `"slide.previous"` - sent by the remote
    * `"slide.changed"` with `%{"index" => i, "total" => n, "title" => title}` -
      sent by the presenter so the remote can show where the deck is.
      `index` is zero-based and below `total`; `title` is at most
      200 characters.
  """
  @behaviour PairMesh.Plugin

  @max_title 200

  @impl true
  def id, do: "presentation"

  @impl true
  def permissions do
    ["slide.next", "slide.previous", "slide.changed"]
  end

  @impl true
  def handle_command("slide.next", _payload, _context) do
    {:ok, %{event: "slide.next"}}
  end

  def handle_command("slide.previous", _payload, _context) do
    {:ok, %{event: "slide.previous"}}
  end

  def handle_command("slide.changed", %{"index" => i, "total" => n, "title" => title}, _context)
      when is_integer(i) and is_integer(n) and i >= 0 and i < n and is_binary(title) do
    if String.length(title) <= @max_title do
      {:ok, %{event: "slide.changed", index: i, total: n, title: title}}
    else
      {:error, :invalid_payload}
    end
  end

  def handle_command("slide.changed", _payload, _context) do
    {:error, :invalid_payload}
  end

  def handle_command(_, _, _) do
    {:error, :unsupported_command}
  end
end
