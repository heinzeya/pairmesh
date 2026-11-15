defmodule PairMesh.Plugins do
  @moduledoc """
  Registry and dispatcher for `PairMesh.Plugin` implementations.

  Enabled plugins are read from `config :pairmesh_core, :plugins`.
  """

  @default_plugins [PairMesh.Plugins.Presentation, PairMesh.Plugins.Gamepad]

  @doc "Returns the list of enabled plugin modules."
  def all do
    Application.get_env(:pairmesh_core, :plugins, @default_plugins)
  end

  @doc "Finds an enabled plugin module by its id."
  def fetch(id) when is_binary(id) do
    case Enum.find(all(), &(&1.id() == id)) do
      nil -> {:error, :unknown_plugin}
      plugin -> {:ok, plugin}
    end
  end

  def fetch(_), do: {:error, :unknown_plugin}

  @doc "Finds the enabled plugin whose `permissions/0` include `command`."
  def fetch_by_command(command) when is_binary(command) do
    case Enum.find(all(), &(command in &1.permissions())) do
      nil -> {:error, :unknown_command}
      plugin -> {:ok, plugin}
    end
  end

  def fetch_by_command(_), do: {:error, :unknown_command}

  @doc """
  Dispatches `command` to the plugin identified by `plugin_id`.

  The command must be listed in the plugin's `permissions/0`.
  """
  def dispatch(plugin_id, command, payload \\ %{}, context \\ %{}) do
    with {:ok, plugin} <- fetch(plugin_id),
         :ok <- authorize(plugin, command) do
      plugin.handle_command(command, payload, context)
    end
  end

  defp authorize(plugin, command) do
    if command in plugin.permissions(), do: :ok, else: {:error, :forbidden}
  end
end
