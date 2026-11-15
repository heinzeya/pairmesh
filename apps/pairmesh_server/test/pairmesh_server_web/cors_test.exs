defmodule PairmeshServerWeb.CorsTest do
  # config/test.exs allows "https://app.example.com".
  use PairmeshServerWeb.ConnCase, async: true

  alias PairmeshServerWeb.Origins

  @allowed "https://app.example.com"

  test "answers preflight requests from allowed origins", %{conn: conn} do
    conn =
      conn
      |> put_req_header("origin", @allowed)
      |> put_req_header("access-control-request-method", "POST")
      |> options(~p"/api/devices")

    assert conn.status == 204
    assert get_resp_header(conn, "access-control-allow-origin") == [@allowed]
    assert get_resp_header(conn, "access-control-allow-methods") == ["GET, POST, OPTIONS"]
  end

  test "adds the allow-origin header to API responses", %{conn: conn} do
    conn = conn |> put_req_header("origin", @allowed) |> post(~p"/api/devices")

    assert json_response(conn, 201)
    assert get_resp_header(conn, "access-control-allow-origin") == [@allowed]
  end

  test "leaves other origins and non-API paths without CORS headers", %{conn: conn} do
    other = conn |> put_req_header("origin", "https://evil.example") |> post(~p"/api/devices")
    assert get_resp_header(other, "access-control-allow-origin") == []

    page = build_conn() |> put_req_header("origin", @allowed) |> get(~p"/")
    assert get_resp_header(page, "access-control-allow-origin") == []
  end

  describe "Origins.allowed?/1" do
    test "matches configured origins by scheme, host and port" do
      assert Origins.allowed?(@allowed)
      assert Origins.allowed?("https://APP.example.com")
      refute Origins.allowed?("http://app.example.com")
      refute Origins.allowed?("https://app.example.com:8443")
      refute Origins.allowed?("https://other.example.com")
    end

    test "always allows the server's own host" do
      assert Origins.allowed?("http://localhost:4002")
    end

    test "rejects missing or malformed origins" do
      refute Origins.allowed?("null")
      refute Origins.allowed?(nil)
    end
  end
end
