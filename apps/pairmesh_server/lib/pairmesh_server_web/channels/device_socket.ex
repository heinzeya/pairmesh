defmodule PairmeshServerWeb.DeviceSocket do
  use Phoenix.Socket

  alias PairmeshServerWeb.DeviceToken

  channel "session:*", PairmeshServerWeb.SessionChannel

  # Bump when the wire protocol changes incompatibly (see docs/protocol.md).
  # Clients that send no "protocol" param are treated as version 1.
  @protocols ["1"]

  @doc "Protocol versions this server speaks."
  def protocols, do: @protocols

  # Devices must present a token issued by `POST /api/devices`.
  @impl true
  def connect(params, socket, _connect_info) do
    with true <- Map.get(params, "protocol", "1") in @protocols,
         {:ok, device_id} <- DeviceToken.verify(params["token"]) do
      {:ok, assign(socket, :device_id, device_id)}
    else
      _ -> :error
    end
  end

  @impl true
  def id(socket), do: "device_socket:#{socket.assigns.device_id}"
end
