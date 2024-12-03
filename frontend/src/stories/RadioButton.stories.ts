// RadioButton.stories.ts
import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { RadioButton, RadioButtonProps } from './RadioButton';
import styles from './RadioButton.module.css';

const meta: Meta<typeof RadioButton> = {
  title: 'Components/RadioButton',
  component: RadioButton,
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

type Story = StoryObj<typeof RadioButton>;

export const Default: Story = {
  args: {
    label: 'radioButton',
    checked: false,
  },
};

export const Checked: Story = {
  args: {
    label: 'radioButton',
    checked: true,
  },
};
