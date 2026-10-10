/**
 * Stacking layers for portaled floating UI.
 *
 * Dialog / sheet / alert-dialog surfaces AND popover-family positioners
 * (select, dropdown, popover, context menu, tooltip) are portaled to
 * `document.body` as siblings. When those siblings share the same z-index,
 * paint order falls back to DOM insertion order — so a dropdown opened inside a
 * dialog *sometimes* paints behind the dialog's opaque background and looks
 * clipped at the modal border, depending on which portal mounted last.
 *
 * Keep floating popover-family content one layer above the modal surfaces so it
 * always floats above an open dialog / sheet, regardless of portal order.
 *
 *   z-40   app chrome (bottom action bars, nav scrims)
 *   z-50   modal surfaces (dialog / sheet / alert-dialog overlay + content)
 *   z-[60] floating popover-family content (this token)
 */
export const POPOVER_LAYER = 'z-[60]'
