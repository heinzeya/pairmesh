defmodule PairMesh.PluginsTest do
  use ExUnit.Case, async: true

  alias PairMesh.Plugins

  test "presentation plugin is registered" do
    assert {:ok, PairMesh.Plugins.Presentation} = Plugins.fetch("presentation")
  end

  test "dispatches allowed commands" do
    assert {:ok, %{event: "slide.next"}} = Plugins.dispatch("presentation", "slide.next")
    assert {:ok, %{event: "slide.previous"}} = Plugins.dispatch("presentation", "slide.previous")
  end

  test "slide.changed announces the current slide" do
    assert {:ok, %{event: "slide.changed", index: 1, total: 5, title: "Intro"}} =
             Plugins.dispatch("presentation", "slide.changed", %{
               "index" => 1,
               "total" => 5,
               "title" => "Intro"
             })

    for payload <- [
          %{},
          %{"index" => 5, "total" => 5, "title" => "x"},
          %{"index" => -1, "total" => 5, "title" => "x"},
          %{"index" => "1", "total" => 5, "title" => "x"},
          %{"index" => 0, "total" => 1, "title" => String.duplicate("x", 201)}
        ] do
      assert {:error, :invalid_payload} =
               Plugins.dispatch("presentation", "slide.changed", payload)
    end
  end

  test "rejects commands not in permissions" do
    assert {:error, :forbidden} = Plugins.dispatch("presentation", "slide.delete")
  end

  test "rejects unknown plugins" do
    assert {:error, :unknown_plugin} = Plugins.dispatch("nope", "slide.next")
  end

  test "finds the plugin that handles a command" do
    assert {:ok, PairMesh.Plugins.Presentation} = Plugins.fetch_by_command("slide.next")
    assert {:error, :unknown_command} = Plugins.fetch_by_command("slide.delete")
    assert {:error, :unknown_command} = Plugins.fetch_by_command(nil)
  end
end
