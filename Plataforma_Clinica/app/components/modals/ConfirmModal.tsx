import { AlertTriangle } from "lucide-react";
import { Modal } from "../shared";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
}: ConfirmModalProps) {
  const colors = {
    danger: {
      icon: "text-red-600",
      bg: "bg-red-50",
      button: "bg-red-600 hover:bg-red-700",
    },
    warning: {
      icon: "text-amber-600",
      bg: "bg-amber-50",
      button: "bg-amber-600 hover:bg-amber-700",
    },
    info: {
      icon: "text-blue-600",
      bg: "bg-blue-50",
      button: "bg-blue-600 hover:bg-blue-700",
    },
  };

  const style = colors[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
        <div className={`p-4 rounded-lg ${style.bg} flex items-start gap-3`}>
          <AlertTriangle className={`w-6 h-6 ${style.icon} flex-shrink-0 mt-0.5`} />
          <p className="text-slate-700">{message}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium ${style.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
