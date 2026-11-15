defmodule PairMesh.Pairings do
  use GenServer

  alias PairMesh.Pairing.Session
  alias PairMesh.Plugins

  @ttl_seconds 300

  # Public API

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, %{}, Keyword.put_new(opts, :name, __MODULE__))
  end

  @doc "Creates a pairing for `plugin_id`; prefer `PairMesh.create_pairing/2`."
  def create(owner, plugin_id) do
    with {:ok, plugin} <- Plugins.fetch(plugin_id) do
      GenServer.call(__MODULE__, {:create, owner, plugin.id()})
    end
  end

  def claim(id, claimant, secret) do
    GenServer.call(__MODULE__, {:claim, id, claimant, secret})
  end

  def approve(id, owner) do
    GenServer.call(__MODULE__, {:approve, id, owner})
  end

  def get(id) do
    GenServer.call(__MODULE__, {:get, id})
  end

  def authorized?(owner, claimant) do
    GenServer.call(__MODULE__, {:authorized?, owner, claimant})
  end

  @doc "True when `device` is the owner or claimant of the approved pairing `id`."
  def participant?(id, device) do
    GenServer.call(__MODULE__, {:participant?, id, device})
  end

  @doc """
  True when `device` may watch pairing `id`: the owner at any stage, or the
  claimant once it has claimed (so it can wait for approval). Use
  `participant?/2` to check whether a device may act on the pairing.
  """
  def member?(id, device) do
    GenServer.call(__MODULE__, {:member?, id, device})
  end

  # Server callbacks

  @impl true
  def init(_) do
    {:ok, %{}}
  end

  @impl true
  def handle_call({:create, owner, plugin_id}, _from, sessions) do
    id = random_token()
    secret = random_token()

    session = %Session{
      id: id,
      owner: owner,
      plugin: plugin_id,
      secret_hash: hash(secret),
      expires_at: System.system_time(:second) + @ttl_seconds
    }

    {:reply, {:ok, session, secret}, Map.put(sessions, id, session)}
  end

  @impl true
  def handle_call({:claim, id, claimant, secret}, _from, sessions) do
    with {:ok, session} <- fetch(sessions, id),
         :ok <- require_status(session, :pending),
         true <- session.owner != claimant,
         true <- secure_match?(session.secret_hash, hash(secret)) do
      updated = %{session | status: :claimed, claimant: claimant}

      {:reply, {:ok, updated}, Map.put(sessions, id, updated)}
    else
      _ -> {:reply, {:error, :invalid_pairing}, sessions}
    end
  end

  @impl true
  def handle_call({:approve, id, owner}, _from, sessions) do
    with {:ok, session} <- fetch(sessions, id),
         :ok <- require_status(session, :claimed),
         true <- session.owner == owner do
      updated = %{session | status: :approved}

      {:reply, {:ok, updated}, Map.put(sessions, id, updated)}
    else
      _ -> {:reply, {:error, :not_allowed}, sessions}
    end
  end

  @impl true
  def handle_call({:get, id}, _from, sessions) do
    {:reply, fetch(sessions, id), sessions}
  end

  @impl true
  def handle_call({:authorized?, owner, claimant}, _from, sessions) do
    allowed =
      Enum.any?(sessions, fn {_id, s} ->
        s.owner == owner and
          s.claimant == claimant and
          s.status == :approved
      end)

    {:reply, allowed, sessions}
  end

  @impl true
  def handle_call({:participant?, id, device}, _from, sessions) do
    allowed =
      case fetch(sessions, id) do
        {:ok, %Session{status: :approved} = s} -> device in [s.owner, s.claimant]
        _ -> false
      end

    {:reply, allowed, sessions}
  end

  @impl true
  def handle_call({:member?, id, device}, _from, sessions) do
    allowed =
      case fetch(sessions, id) do
        {:ok, %Session{owner: ^device}} -> true
        {:ok, %Session{claimant: ^device, status: status}} -> status in [:claimed, :approved]
        _ -> false
      end

    {:reply, allowed, sessions}
  end

  # Private functions

  defp fetch(sessions, id) do
    case Map.get(sessions, id) do
      nil -> {:error, :not_found}
      session -> {:ok, session}
    end
  end

  defp require_status(session, status) do
    cond do
      System.system_time(:second) >= session.expires_at ->
        {:error, :expired}

      session.status != status ->
        {:error, :invalid_state}

      true ->
        :ok
    end
  end

  defp random_token do
    32
    |> :crypto.strong_rand_bytes()
    |> Base.url_encode64(padding: false)
  end

  defp hash(value) when is_binary(value) do
    :crypto.hash(:sha256, value)
  end

  defp secure_match?(a, b)
       when is_binary(a) and is_binary(b) and byte_size(a) == byte_size(b) do
    :crypto.hash_equals(a, b)
  end

  defp secure_match?(_, _), do: false
end
