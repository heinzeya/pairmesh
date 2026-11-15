defmodule PairmeshServerWeb.ChannelCase do
  @moduledoc """
  Test case for channel tests.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      import Phoenix.ChannelTest
      import PairmeshServerWeb.ChannelCase

      @endpoint PairmeshServerWeb.Endpoint
    end
  end
end
