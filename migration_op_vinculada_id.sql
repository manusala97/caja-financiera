-- Migración: agregar columna op_vinculada_id a movimientos_cc
-- Esta columna vincula los dos movimientos de una transferencia CC entre sí.
-- Para una transferencia A→B:
--   - el movimiento ingreso_transf de A tendrá op_vinculada_id = id del retiro_transf de B
--   - el movimiento retiro_transf de B tendrá op_vinculada_id = id del ingreso_transf de A
-- Esto permite mostrar ambos como una sola fila en la vista de movimientos.

ALTER TABLE movimientos_cc
ADD COLUMN IF NOT EXISTS op_vinculada_id bigint REFERENCES movimientos_cc(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_cc_op_vinculada ON movimientos_cc(op_vinculada_id);
