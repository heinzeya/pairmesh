defmodule PairmeshServerWeb.Origins do
  @moduledoc """
  Decides which browser origins may use the device API (`/api/*`) and the
  `/socket` WebSocket, so apps built with the PairMesh SDKs can run on their
  own domains.

      config :pairmesh_server, :allowed_origins, ["https://myapp.com"]
      config :pairmesh_server, :allowed_origins, :all

  The server's own host (`url: [host: ...]` on the endpoint) is always
  allowed. Origins are compared as `scheme://host:port`.
  """

  @doc "True when `origin` (a string or `%URI{}`) may connect."
  def allowed?(origin) when is_binary(origin), do: origin |> URI.parse() |> allowed?()

  def allowed?(%URI{host: host}) when host in [nil, ""], do: false

  def allowed?(%URI{} = uri) do
    case Application.get_env(:pairmesh_server, :allowed_origins, []) do
      :all -> true
      origins when is_list(origins) -> own_host?(uri) or normalize(uri) in normalized(origins)
    end
  end

  def allowed?(_), do: false

  defp own_host?(uri), do: uri.host == PairmeshServerWeb.Endpoint.config(:url)[:host]

  defp normalized(origins), do: Enum.map(origins, &(&1 |> URI.parse() |> normalize()))

  defp normalize(%URI{scheme: scheme, host: host, port: port}),
    do: {scheme && String.downcase(scheme), host && String.downcase(host), port}
end
