// Checkbox.stories.ts
import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { Checkbox, CheckboxProps } from './Checkbox';
import styles from './Checkbox.module.css';

const meta: Meta<typeof Checkbox> = {
  title: 'Components/Checkbox',
  component: Checkbox,
  argTypes: {
    label: {
      control: 'text',
    },
    checked: {
      control: 'boolean',
    },
  },
};

export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: {
    label: 'checkbox',
    checked: false,
  },
};

export const Checked: Story = {
  args: {
    label: 'checkbox',
    checked: true,
  },
};
