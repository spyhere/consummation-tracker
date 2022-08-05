import apiClient from "../apiClient"
import { Day } from "./types"

export type entriesPaginated = {
  data: {
    dates: Day[]
  }
  meta: {
    cursor: number
  }
}
export const getPaginatedEntries = (cursor = "", userId = ""): Promise<entriesPaginated> => {
  return apiClient.get(`/entries?cursor=${cursor}&user=${userId}`)
    .then((response) => response.data)
}

export type entriesStats = {
  monthMoneySpent: string,
  dayCalories: number
}
export const getEntriesStats = (): Promise<entriesStats> => {
  return apiClient.get("/entries/stats").then((response) => response.data.data)
}
