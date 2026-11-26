import type { AlertButton } from 'react-native';

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const text = [title, message].filter(Boolean).join("\n\n");
    const action = buttons?.find(button => button.style !== 'cancel');
    const cancel = buttons?.find(button => button.style === 'cancel');
    if (action && cancel) {
      if (window.confirm(text)) action.onPress?.();
      else cancel.onPress?.();
    } else {
      window.alert(text);
      action?.onPress?.();
    }
  },
};
