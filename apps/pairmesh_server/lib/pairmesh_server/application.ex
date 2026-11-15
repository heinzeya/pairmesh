defmodule PairmeshServer.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      PairmeshServerWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:pairmesh_server, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: PairmeshServer.PubSub},
      # Start a worker by calling: PairmeshServer.Worker.start_link(arg)
      # {PairmeshServer.Worker, arg},
      # Start to serve requests, typically the last entry
      PairmeshServerWeb.Endpoint
    ]

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: PairmeshServer.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    PairmeshServerWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
