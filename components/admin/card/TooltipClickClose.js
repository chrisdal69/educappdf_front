import { cloneElement, isValidElement, useState } from "react";
import { Tooltip as AntTooltip } from "antd";

const callAll =
  (...handlers) =>
  (event) => {
    handlers.forEach((handler) => {
      if (typeof handler === "function") handler(event);
    });
  };

const TooltipClickClose = ({
  children,
  open: controlledOpen,
  onOpenChange,
  ...props
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = typeof controlledOpen === "boolean";
  const resolvedOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = (nextOpen) => {
    if (!isControlled) setUncontrolledOpen(nextOpen);
    if (onOpenChange) onOpenChange(nextOpen);
  };

  const handleClick = (event) => {
    if (event?.currentTarget?.blur) event.currentTarget.blur();
    if (!isControlled) setUncontrolledOpen(false);
    if (onOpenChange) onOpenChange(false);
  };

  if (!isValidElement(children)) {
    return (
      <AntTooltip
        {...props}
        open={resolvedOpen}
        onOpenChange={handleOpenChange}
      >
        {children}
      </AntTooltip>
    );
  }

  return (
    <AntTooltip {...props} open={resolvedOpen} onOpenChange={handleOpenChange}>
      {cloneElement(children, {
        onClick: callAll(children.props?.onClick, handleClick),
      })}
    </AntTooltip>
  );
};

export default TooltipClickClose;
