import { describe, expect, it } from 'vitest';

import { updateActionButtonSx } from './updateActionButton';

describe('update action button style', () => {
  it('keeps readable contrast when hovered', () => {
    expect(updateActionButtonSx).toMatchObject({
      bgcolor: 'info.main',
      color: 'common.white',
      '&:hover': {
        bgcolor: 'info.dark',
        color: 'common.white',
      },
    });
  });
});
