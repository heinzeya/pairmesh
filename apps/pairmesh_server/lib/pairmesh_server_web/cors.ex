defmodule PairmeshServerWeb.Cors do
  @moduledoc """
  CORS for the device API, so SDKs running on other origins can call
  `POST /api/devices`. Origins are checked with `PairmeshServerWeb.Origins`;
  preflight `OPTIONS` requests are answered here and halt.
  """
  @behaviour Plug

  import Plug.Conn

  alias PairmeshServerWeb.Origins

  @impl true
  def init(opts), do: Keyword.get(opts, :path_prefix, "/api")

  @impl true
  def call(%Plug.Conn{} = conn, prefix) do
    if String.starts_with?(conn.request_path, prefix) do
      origin = conn |> get_req_header("origin") |> List.first()
      conn |> put_cors_headers(origin) |> maybe_answer_preflight()
    else
      conn
    end
  end

  defp put_cors_headers(conn, origin) when is_binary(origin) do
    if Origins.allowed?(origin) do
      conn
      |> put_resp_header("access-control-allow-origin", origin)
      |> put_resp_header("vary", "origin")
    else
      conn
    end
  end

  defp put_cors_headers(conn, _origin), do: conn

  defp maybe_answer_preflight(%Plug.Conn{method: "OPTIONS"} = conn) do
    conn
    |> put_resp_header("access-control-allow-methods", "GET, POST, OPTIONS")
    |> put_resp_header("access-control-allow-headers", "content-type")
    |> put_resp_header("access-control-max-age", "600")
    |> send_resp(204, "")
    |> halt()
  end

  defp maybe_answer_preflight(conn), do: conn
end
