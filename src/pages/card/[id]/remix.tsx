import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function RemixPage() {
  const router = useRouter()
  const { id } = router.query as { id?: string }

  useEffect(() => {
    if (id) {
      router.replace(`/card/${id}`)
    }
  }, [id, router])

  return null
}
