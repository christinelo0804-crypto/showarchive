import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { updateShow } from '../db/repositories'
import { ShowForm } from '../components/ShowForm'
import { useToast } from '../components/Toast'

export default function EditShowPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const show = useLiveQuery(async () => (id ? await db.shows.get(id) : undefined), [id])

  if (!id) return <Navigate to="/shows" replace />
  if (!show) {
    return (
      <div className="page">
        <p className="muted">记录不存在或已删除。</p>
      </div>
    )
  }

  return (
    <ShowForm
      mode="edit"
      initial={show}
      onSave={async (payload, opts) => {
        await updateShow(id, payload, opts)
        toast.push('success', '记录已更新')
        navigate(`/shows/${id}`, { replace: true })
      }}
      onCancel={() => navigate(-1)}
    />
  )
}
