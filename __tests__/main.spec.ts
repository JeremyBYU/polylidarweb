import { add } from '../src/main'

describe('greeter function', () => {
  // Read more about fake timers: http://facebook.github.io/jest/docs/en/timer-mocks.html#content

  it('Adder add correctly', () => {
      expect(add(1,2)).toBe(3)
  })

})
