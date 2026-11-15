defmodule PairmeshServerWeb.SessionChannelTest do
  use PairmeshServerWeb.ChannelCase

  alias PairMesh.Pairings
  alias PairmeshServerWeb.{DeviceSocket, DeviceToken, SessionChannel}

  defp unique_device, do: "device-#{System.unique_integer([:positive])}"

  defp connect_device(device_id) do
    {:ok, socket} = connect(DeviceSocket, %{"token" => DeviceToken.sign(device_id)})
    socket
  end

  defp join_session(device_id, pairing_id, params \\ %{}) do
    device_id
    |> connect_device()
    |> subscribe_and_join(SessionChannel, "session:#{pairing_id}", params)
  end

  defp approved_pairing(owner, claimant, plugin \\ "presentation") do
    {:ok, session, secret} = Pairings.create(owner, plugin)
    {:ok, _} = Pairings.claim(session.id, claimant, secret)
    {:ok, _} = Pairings.approve(session.id, owner)
    session.id
  end

  describe "socket auth" do
    test "rejects connections without a token" do
      assert :error = connect(DeviceSocket, %{})
    end

    test "rejects connections with a forged token" do
      assert :error = connect(DeviceSocket, %{"token" => "forged"})
    end

    test "accepts protocol 1 and rejects unknown protocol versions" do
      token = DeviceToken.sign(unique_device())
      assert {:ok, _} = connect(DeviceSocket, %{"token" => token, "protocol" => "1"})
      assert :error = connect(DeviceSocket, %{"token" => token, "protocol" => "99"})
    end
  end

  describe "full pairing flow" do
    test "create, claim, requested, approve, slide.next" do
      laptop = unique_device()
      phone = unique_device()

      # pairing.create
      {:ok, _, lobby} = join_session(laptop, "lobby")
      ref = push(lobby, "pairing.create", %{"plugin" => "presentation"})
      assert_reply ref, :ok, %{pairing_id: pairing_id, secret: secret, plugin: "presentation"}

      {:ok, _, laptop_socket} = join_session(laptop, pairing_id)

      # pairing.claim -> pairing.requested
      {:ok, _, phone_socket} = join_session(phone, pairing_id, %{"secret" => secret})
      assert_broadcast "pairing.requested", %{"device_id" => ^phone}

      # Not approved yet: commands are refused.
      ref = push(phone_socket, "slide.next", %{})
      assert_reply ref, :error, %{reason: "not_approved"}

      # Only the owner may approve.
      ref = push(phone_socket, "pairing.approve", %{})
      assert_reply ref, :error, %{reason: "not_allowed"}

      # pairing.approve -> pairing.approved
      ref = push(laptop_socket, "pairing.approve", %{})
      assert_reply ref, :ok
      assert_broadcast "pairing.approved", %{"device_id" => ^phone}

      # slide.next is relayed to the session
      ref = push(phone_socket, "slide.next", %{})
      assert_reply ref, :ok, %{event: "slide.next"}

      assert_broadcast "slide.next", %{
        "plugin" => "presentation",
        "device_id" => ^phone
      }
    end
  end

  describe "join" do
    setup do
      owner = unique_device()
      claimant = unique_device()
      %{owner: owner, claimant: claimant, pairing_id: approved_pairing(owner, claimant)}
    end

    test "owner and approved claimant can (re)join without a secret", ctx do
      assert {:ok, %{status: "approved", plugin: "presentation", role: "owner"}, _} =
               join_session(ctx.owner, ctx.pairing_id)

      assert {:ok, %{status: "approved", role: "claimant"}, _} =
               join_session(ctx.claimant, ctx.pairing_id)
    end

    test "outsider cannot join", %{pairing_id: pairing_id} do
      assert {:error, %{reason: "unauthorized"}} = join_session(unique_device(), pairing_id)
    end

    test "a used secret cannot be claimed again" do
      owner = unique_device()
      {:ok, session, secret} = Pairings.create(owner, "presentation")
      {:ok, _} = Pairings.claim(session.id, unique_device(), secret)

      assert {:error, %{reason: "unauthorized"}} =
               join_session(unique_device(), session.id, %{"secret" => secret})
    end

    test "wrong secret is rejected" do
      {:ok, session, _secret} = Pairings.create(unique_device(), "presentation")

      assert {:error, %{reason: "unauthorized"}} =
               join_session(unique_device(), session.id, %{"secret" => "wrong"})
    end

    test "cannot join an unknown pairing" do
      assert {:error, %{reason: "unauthorized"}} = join_session(unique_device(), "nope")
    end
  end

  describe "approved session" do
    setup do
      owner = unique_device()
      claimant = unique_device()
      pairing_id = approved_pairing(owner, claimant)
      {:ok, _, socket} = join_session(claimant, pairing_id)
      %{socket: socket}
    end

    test "ping replies with the payload", %{socket: socket} do
      ref = push(socket, "ping", %{"hello" => "there"})
      assert_reply ref, :ok, %{"hello" => "there"}
    end

    test "relay broadcasts to the session topic", %{socket: socket} do
      push(socket, "relay", %{"msg" => "hi"})
      assert_broadcast "relay", %{"msg" => "hi"}
    end

    test "commands outside the pairing's plugin are rejected", %{socket: socket} do
      ref = push(socket, "slide.delete", %{})
      assert_reply ref, :error, %{reason: "forbidden"}

      ref = push(socket, "gamepad.button.down", %{"button" => "a"})
      assert_reply ref, :error, %{reason: "forbidden"}
    end
  end

  describe "gamepad session" do
    setup do
      owner = unique_device()
      claimant = unique_device()
      pairing_id = approved_pairing(owner, claimant, "gamepad")
      {:ok, _, socket} = join_session(claimant, pairing_id)
      %{socket: socket, claimant: claimant}
    end

    test "relays button and stick events", %{socket: socket, claimant: claimant} do
      ref = push(socket, "gamepad.button.down", %{"button" => "a"})
      assert_reply ref, :ok, %{event: "gamepad.button.down", button: "a"}

      assert_broadcast "gamepad.button.down", %{
        "button" => "a",
        "plugin" => "gamepad",
        "device_id" => ^claimant
      }

      ref = push(socket, "gamepad.stick", %{"stick" => "left", "x" => 2, "y" => -0.5})
      assert_reply ref, :ok, %{event: "gamepad.stick"}
      assert_broadcast "gamepad.stick", %{"stick" => "left", "x" => 1.0, "y" => -0.5}
    end

    test "rejects invalid payloads and presentation commands", %{socket: socket} do
      ref = push(socket, "gamepad.button.down", %{"button" => "turbo"})
      assert_reply ref, :error, %{reason: "invalid_payload"}

      ref = push(socket, "slide.next", %{})
      assert_reply ref, :error, %{reason: "forbidden"}
    end
  end

  describe "pairing.create" do
    test "creates a gamepad pairing" do
      {:ok, _, lobby} = join_session(unique_device(), "lobby")
      ref = push(lobby, "pairing.create", %{"plugin" => "gamepad"})
      assert_reply ref, :ok, %{plugin: "gamepad"}
    end

    test "requires a known plugin" do
      {:ok, _, lobby} = join_session(unique_device(), "lobby")

      ref = push(lobby, "pairing.create", %{})
      assert_reply ref, :error, %{reason: "unknown_plugin"}

      ref = push(lobby, "pairing.create", %{"plugin" => "nope"})
      assert_reply ref, :error, %{reason: "unknown_plugin"}
    end
  end

  test "lobby only accepts pairing.create" do
    {:ok, _, lobby} = join_session(unique_device(), "lobby")
    ref = push(lobby, "slide.next", %{})
    assert_reply ref, :error, %{reason: "unknown_event"}
  end
end
