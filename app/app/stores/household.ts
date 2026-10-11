import { defineStore } from 'pinia'
import type { Household, HouseholdMemberProfile } from '~/types/household'
import {
  createHousehold,
  createInvite,
  fetchHouseholdMembers,
  fetchMyHousehold,
  redeemInvite,
} from '~/composables/household-actions'
import { errorMessage } from '~/utils/error-message'

export const useHouseholdStore = defineStore('household', {
  state: () => ({
    household: null as Household | null,
    loading: false,
    error: null as string | null,
    /** The household's members with their email addresses, for the avatars
     * on the dashboard. Loaded apart from the household itself, so the
     * dashboard doesn't wait for them. */
    members: [] as HouseholdMemberProfile[],
    membersError: null as string | null,
  }),
  actions: {
    async fetchMine() {
      this.loading = true
      this.error = null
      try {
        this.household = await fetchMyHousehold(useSupabaseClient())
      } catch (e) {
        this.error = errorMessage(e)
      } finally {
        this.loading = false
      }
    },

    /**
     * Loads the members of the current household. The result is only kept
     * if the household is still the one that was asked for: a fetch that
     * ends after a sign-out or a change of user would otherwise put the
     * previous household's email addresses in front of the next user.
     */
    async fetchMembers() {
      const householdId = this.household?.id
      if (!householdId) return
      this.membersError = null
      try {
        const members = await fetchHouseholdMembers(useSupabaseClient(), householdId)
        if (this.household?.id === householdId) this.members = members
      } catch (e) {
        if (this.household?.id === householdId) this.membersError = errorMessage(e)
      }
    },

    async create(name: string) {
      this.loading = true
      this.error = null
      try {
        this.household = await createHousehold(useSupabaseClient(), name)
      } catch (e) {
        this.error = errorMessage(e)
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
        this.error = errorMessage(e)
        throw e
      } finally {
        this.loading = false
      }
    },
  },
})
