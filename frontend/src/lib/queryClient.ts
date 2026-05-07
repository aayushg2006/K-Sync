import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: "always",
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 0,
    },
  },
});
