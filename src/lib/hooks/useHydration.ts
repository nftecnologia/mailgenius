import { useState, useEffect } from 'react'

export function useHydration() {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return isHydrated
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const isHydrated = useHydration()

  const [storedValue, setStoredValue] = useState<T>(initialValue)

  // Get value from localStorage only after hydration
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      try {
        const item = localStorage.getItem(key)
        if (item) {
          setStoredValue(JSON.parse(item))
        }
      } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error)
      }
    }
  }, [isHydrated, key])

  const setValue = (value: T) => {
    try {
      setStoredValue(value)
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value))
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue]
}

export function useClientOnly<T>(clientValue: T, serverValue: T): T {
  const isHydrated = useHydration()
  return isHydrated ? clientValue : serverValue
}
