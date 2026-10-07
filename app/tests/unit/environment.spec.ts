import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'

// Smoke test for the test toolchain itself (Vitest + happy-dom + @vue/test-utils),
// so CI/hooks fail loudly if the setup breaks, before any real feature test is added.
describe('test environment', () => {
  it('mounts a reactive Vue component under happy-dom', async () => {
    const Counter = defineComponent({
      setup() {
        const count = ref(0)
        return { count }
      },
      template: '<button @click="count++">{{ count }}</button>',
    })

    const wrapper = mount(Counter)
    expect(wrapper.text()).toBe('0')

    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toBe('1')
  })
})
