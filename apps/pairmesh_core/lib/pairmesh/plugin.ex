defmodule PairMesh.Plugin do
  @callback id() :: String.t()

  @callback permissions() :: [String.t()]

  @callback handle_command(
              command :: String.t(),
              payload :: map(),
              context :: map()
            ) ::
              {:ok, map()} | {:error, term()}
end
