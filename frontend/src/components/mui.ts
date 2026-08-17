/**
 * MUI components with their polymorphic `component` generics collapsed.
 *
 * MUI types `component` against every key of JSX.IntrinsicElements. Since
 * react-three-fiber globally augments that interface with the whole three.js
 * element set, the resulting union exceeds TypeScript's limit and the build
 * fails with "Expression produces a union type that is too complex to
 * represent". Re-exporting through a fixed prop type keeps the exact same
 * runtime components while dropping the overloads that cause the blowup.
 */

import type { ComponentType } from 'react'

import MuiAppBar from '@mui/material/AppBar'
import MuiBadge from '@mui/material/Badge'
import MuiBox from '@mui/material/Box'
import MuiButton from '@mui/material/Button'
import MuiCard from '@mui/material/Card'
import MuiCardContent from '@mui/material/CardContent'
import MuiChip from '@mui/material/Chip'
import MuiDialog from '@mui/material/Dialog'
import MuiDialogActions from '@mui/material/DialogActions'
import MuiDialogContent from '@mui/material/DialogContent'
import MuiDialogTitle from '@mui/material/DialogTitle'
import MuiDrawer from '@mui/material/Drawer'
import MuiIconButton from '@mui/material/IconButton'
import MuiLinearProgress from '@mui/material/LinearProgress'
import MuiList from '@mui/material/List'
import MuiListItemButton from '@mui/material/ListItemButton'
import MuiListItemIcon from '@mui/material/ListItemIcon'
import MuiListItemText from '@mui/material/ListItemText'
import MuiTable from '@mui/material/Table'
import MuiTableBody from '@mui/material/TableBody'
import MuiTableCell from '@mui/material/TableCell'
import MuiTableHead from '@mui/material/TableHead'
import MuiTableRow from '@mui/material/TableRow'
import MuiTextField from '@mui/material/TextField'
import MuiToolbar from '@mui/material/Toolbar'
import MuiTypography from '@mui/material/Typography'

import type { AppBarProps } from '@mui/material/AppBar'
import type { BadgeProps } from '@mui/material/Badge'
import type { BoxProps } from '@mui/material/Box'
import type { ButtonProps } from '@mui/material/Button'
import type { CardProps } from '@mui/material/Card'
import type { CardContentProps } from '@mui/material/CardContent'
import type { ChipProps } from '@mui/material/Chip'
import type { DialogProps } from '@mui/material/Dialog'
import type { DialogActionsProps } from '@mui/material/DialogActions'
import type { DialogContentProps } from '@mui/material/DialogContent'
import type { DialogTitleProps } from '@mui/material/DialogTitle'
import type { DrawerProps } from '@mui/material/Drawer'
import type { IconButtonProps } from '@mui/material/IconButton'
import type { LinearProgressProps } from '@mui/material/LinearProgress'
import type { ListProps } from '@mui/material/List'
import type { ListItemButtonProps } from '@mui/material/ListItemButton'
import type { ListItemIconProps } from '@mui/material/ListItemIcon'
import type { ListItemTextProps } from '@mui/material/ListItemText'
import type { TableProps } from '@mui/material/Table'
import type { TableBodyProps } from '@mui/material/TableBody'
import type { TableCellProps } from '@mui/material/TableCell'
import type { TableHeadProps } from '@mui/material/TableHead'
import type { TableRowProps } from '@mui/material/TableRow'
import type { TextFieldProps } from '@mui/material/TextField'
import type { ToolbarProps } from '@mui/material/Toolbar'
import type { TypographyProps } from '@mui/material/Typography'

/**
 * Props MUI adds for polymorphic rendering. `React.ElementType` is deliberately
 * avoided here: it resolves to `keyof JSX.IntrinsicElements | ...`, which is the
 * union that overflows once react-three-fiber registers its elements.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Poly = { component?: string | ComponentType<any>; href?: string }

export const AppBar = MuiAppBar as ComponentType<AppBarProps & Poly>
export const Badge = MuiBadge as ComponentType<BadgeProps & Poly>
export const Box = MuiBox as ComponentType<BoxProps & Poly>
export const Button = MuiButton as ComponentType<ButtonProps & Poly>
export const Card = MuiCard as ComponentType<CardProps & Poly>
export const CardContent = MuiCardContent as ComponentType<CardContentProps & Poly>
export const Chip = MuiChip as ComponentType<ChipProps & Poly>
export const Dialog = MuiDialog as ComponentType<DialogProps & Poly>
export const DialogActions = MuiDialogActions as ComponentType<DialogActionsProps & Poly>
export const DialogContent = MuiDialogContent as ComponentType<DialogContentProps & Poly>
export const DialogTitle = MuiDialogTitle as ComponentType<DialogTitleProps & Poly>
export const Drawer = MuiDrawer as ComponentType<DrawerProps & Poly>
export const IconButton = MuiIconButton as ComponentType<IconButtonProps & Poly>
export const LinearProgress = MuiLinearProgress as ComponentType<LinearProgressProps & Poly>
export const List = MuiList as ComponentType<ListProps & Poly>
export const ListItemButton = MuiListItemButton as ComponentType<ListItemButtonProps & Poly>
export const ListItemIcon = MuiListItemIcon as ComponentType<ListItemIconProps & Poly>
export const ListItemText = MuiListItemText as ComponentType<ListItemTextProps & Poly>
export const Table = MuiTable as ComponentType<TableProps & Poly>
export const TableBody = MuiTableBody as ComponentType<TableBodyProps & Poly>
export const TableCell = MuiTableCell as ComponentType<TableCellProps & Poly>
export const TableHead = MuiTableHead as ComponentType<TableHeadProps & Poly>
export const TableRow = MuiTableRow as ComponentType<TableRowProps & Poly>
export const TextField = MuiTextField as ComponentType<TextFieldProps & Poly>
export const Toolbar = MuiToolbar as ComponentType<ToolbarProps & Poly>
export const Typography = MuiTypography as ComponentType<TypographyProps & Poly>
