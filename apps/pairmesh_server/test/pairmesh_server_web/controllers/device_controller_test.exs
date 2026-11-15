defmodule PairmeshServerWeb.DeviceControllerTest do
  use PairmeshServerWeb.ConnCase

  test "POST /api/devices issues a verifiable token", %{conn: conn} do
    assert %{"device_id" => device_id, "token" => token} =
             json_response(post(conn, ~p"/api/devices"), 201)

    assert {:ok, ^device_id} = PairmeshServerWeb.DeviceToken.verify(token)
  end
end
