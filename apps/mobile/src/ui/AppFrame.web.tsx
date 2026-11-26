import type { PropsWithChildren } from 'react';
import './AppFrame.web.css';

export function AppFrame({ children }: PropsWithChildren) {
  return (
    <div className="moodi-browser-canvas">
      <div className="moodi-phone-stage">
        <div className="moodi-phone-app">{children}</div>
      </div>
    </div>
  );
}
