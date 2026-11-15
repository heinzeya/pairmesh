defmodule PairmeshServerWeb.DeviceToken do
  @moduledoc "Signs and verifies device identity tokens used to connect to the socket."

  @salt "device socket"
  @max_age 60 * 60 * 24 * 30

  def sign(device_id) when is_binary(device_id) do
    Phoenix.Token.sign(PairmeshServerWeb.Endpoint, @salt, device_id)
  end

  def verify(token) when is_binary(token) do
    Phoenix.Token.verify(PairmeshServerWeb.Endpoint, @salt, token, max_age: @max_age)
  end

  def verify(_), do: {:error, :missing}
end
