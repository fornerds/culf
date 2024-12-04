// Button.stories.ts
import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { Button, ButtonProps } from './Button';
import styles from './button.module.css';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    size: {
      control: {
        type: 'select',
        options: ['size1', 'size2', 'size3', 'size4'],
      },
    },
    variant: {
      control: {
        type: 'select',
        options: [
          'default',
          'plus_icon',
          'less-highlight',
          'warning',
          'disable',
        ],
      },
    },
    children: {
      control: 'text',
    },
    onClick: { action: 'clicked' },
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button',
    size: 'size1',
    variant: 'default',
  },
};

export const PlusIcon: Story = {
  args: {
    children: 'Add Item',
    size: 'size2',
    variant: 'plus_icon',
  },
};

export const LessHighlight: Story = {
  args: {
    children: 'Less Highlight',
    size: 'size3',
    variant: 'less-highlight',
  },
};

export const Warning: Story = {
  args: {
    children: 'Warning',
    size: 'size4',
    variant: 'warning',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    size: 'size2',
    variant: 'disable',
  },
};
