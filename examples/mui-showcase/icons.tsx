import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';

/**
 * Three Material icons as paths, so the example needs nothing beyond `@mui/material`. In your own
 * project, `@mui/icons-material` gives you the same components by name: `MailOutline`,
 * `TrendingUp`, `DeleteOutline`.
 */
export const MailIcon = (props: SvgIconProps) => (
    <SvgIcon {...props}>
        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2m0 14H4V8l8 5 8-5zm-8-7L4 6h16z" />
    </SvgIcon>
);

export const RaiseIcon = (props: SvgIconProps) => (
    <SvgIcon {...props}>
        <path d="m16 6 2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
    </SvgIcon>
);

export const DeleteIcon = (props: SvgIconProps) => (
    <SvgIcon {...props}>
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM8 9h8v10H8zm7.5-5-1-1h-5l-1 1H5v2h14V4z" />
    </SvgIcon>
);
