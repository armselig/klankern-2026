import { defineStore } from 'pinia'
import type { Household } from '~/types/household'
import {
  createHousehold,
  createInvite,
  fetchMyHousehold,
  redeemInvite,
} from '~/composables/household-actions'

export const useHouseholdStore = defineStore('household', {
  state: () => ({
    household: null as Household | null,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchMine() {
      this.loading = true
      this.error = null
      try {
        this.household = await fetchMyHousehold(useSupabaseClient())
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'unknown_error'
      } finally {
        this.loading = false
      }
    },

    async create(name: string) {
      this.loading = true
      this.error = null
      try {
        this.household = await createHousehold(useSupabaseClient(), name)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'unknown_error'
        throw e
      } finally {
        this.loading = false
      }
    },

    async invite(): Promise<string> {
      if (!this.household) throw new Error('no_household')
      return createInvite(useSupabaseClient(), this.household.id)
    },

    async redeem(code: string) {
      this.loading = true
      this.error = null
      try {
        await redeemInvite(useSupabaseClient(), code)
        await this.fetchMine()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'unknown_error'
        throw e
      } finally {
        this.loading = false
      }
    },
  },
})
