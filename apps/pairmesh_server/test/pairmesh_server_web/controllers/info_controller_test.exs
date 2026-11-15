defmodule PairmeshServerWeb.InfoControllerTest do
  use PairmeshServerWeb.ConnCase, async: true

  test "GET / describes the server", %{conn: conn} do
    assert %{"name" => "PairMesh", "protocols" => ["1"], "plugins" => plugins} =
             json_response(get(conn, ~p"/"), 200)

    assert "presentation" in plugins
    assert "gamepad" in plugins
  end
end
