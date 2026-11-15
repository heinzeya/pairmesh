defmodule PairmeshServerWeb.Router do
  use PairmeshServerWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", PairmeshServerWeb do
    pipe_through :api

    get "/", InfoController, :show
  end

  scope "/api", PairmeshServerWeb do
    pipe_through :api

    get "/health", HealthController, :show
    post "/devices", DeviceController, :create
  end
end
