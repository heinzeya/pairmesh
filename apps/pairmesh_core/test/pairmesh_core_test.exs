defmodule PairmeshCoreTest do
  use ExUnit.Case
  doctest PairmeshCore

  test "greets the world" do
    assert PairmeshCore.hello() == :world
  end
end
