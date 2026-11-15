defmodule PairmeshServerWeb.DeviceController do
  use PairmeshServerWeb, :controller

  alias PairmeshServerWeb.DeviceToken

  # Issues a fresh device identity. Holding a token grants nothing on its own:
  # a device can only join pairings it owns or has been approved to claim.
  def create(conn, _params) do
    device_id = 16 |> :crypto.strong_rand_bytes() |> Base.url_encode64(padding: false)

    conn
    |> put_status(:created)
    |> json(%{device_id: device_id, token: DeviceToken.sign(device_id)})
  end
end
