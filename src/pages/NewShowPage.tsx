import { useNavigate } from 'react-router-dom'
import { ShowForm } from '../components/ShowForm'
import { useToast } from '../components/Toast'
import { saveShow } from '../db/repositories'

export default function NewShowPage() {
  const navigate = useNavigate()
  const toast = useToast()

  return (
    <ShowForm
      mode="create"
      onSave={async (payload, opts) => {
        await saveShow(payload, opts)
        toast.push('success', opts.publish ? '记录已发布' : '草稿已保存')
        navigate(opts.publish ? '/' : '/shows', { replace: true })
      }}
    />
  )
}
