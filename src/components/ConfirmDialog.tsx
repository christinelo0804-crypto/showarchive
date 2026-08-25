import { Button } from './ui'
import { Modal } from './Modal'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  busy = false,
  onConfirm,
  onClose
}: {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {cancelText}
          </Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="muted" style={{ margin: 0 }}>
        {message}
      </p>
    </Modal>
  )
}
