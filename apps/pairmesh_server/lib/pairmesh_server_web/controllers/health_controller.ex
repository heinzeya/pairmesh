defmodule PairmeshServerWeb.HealthController do
  use PairmeshServerWeb, :controller

  def show(conn, _params) do
    json(conn, %{status: "ok"})
  end
end
