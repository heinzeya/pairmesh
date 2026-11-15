defmodule PairmeshServerWeb.InfoController do
  @moduledoc "`GET /`: what this server is and which protocol versions it speaks."
  use PairmeshServerWeb, :controller

  def show(conn, _params) do
    json(conn, %{
      name: "PairMesh",
      protocols: PairmeshServerWeb.DeviceSocket.protocols(),
      plugins: Enum.map(PairMesh.Plugins.all(), & &1.id()),
      docs: "docs/protocol.md"
    })
  end
end
