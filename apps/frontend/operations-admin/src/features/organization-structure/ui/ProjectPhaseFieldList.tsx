import {DownOutlined, PlusOutlined, UpOutlined} from '@ant-design/icons';
import {Button, Form, Input, Space} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';

export function ProjectPhaseFieldList() {
  return (
    <Form.List
      name="phaseDrafts"
      rules={[
        {
          validator: async (_, values: Array<{name?: string}> | undefined) => {
            const names = (values ?? []).map(value => value.name?.trim() ?? '');
            if (names.some(name => !name)) throw new Error('项目分期名称不能为空');
            if (new Set(names).size !== names.length) throw new Error('项目分期名称不能重复');
          },
        },
      ]}
    >
      {(fields, {add, remove, move}, {errors}) => (
        <Form.Item label="项目分期名称">
          <Space orientation="vertical" style={{width: '100%'}}>
            {fields.map((field, index) => (
              <Space key={field.key} align="start" style={{width: '100%'}}>
                <Form.Item
                  name={[field.name, 'name']}
                  noStyle
                  rules={[{required: true, whitespace: true, message: '请输入项目分期名称'}]}
                >
                  <Input aria-label={`项目分期名称 ${index + 1}`} maxLength={120} />
                </Form.Item>
                <Button
                  disabled={index === 0}
                  icon={<UpOutlined />}
                  onClick={() => move(index, index - 1)}
                  {...testId(`operations-project-phase-up-${index}`)}
                />
                <Button
                  disabled={index === fields.length - 1}
                  icon={<DownOutlined />}
                  onClick={() => move(index, index + 1)}
                  {...testId(`operations-project-phase-down-${index}`)}
                />
                <Button
                  danger
                  onClick={() => remove(field.name)}
                  {...testId(`operations-project-phase-remove-${index}`)}
                >
                  删除
                </Button>
              </Space>
            ))}
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => add({name: ''})}
              {...testId('operations-project-phase-add')}
            >
              添加项目分期
            </Button>
            <Form.ErrorList errors={errors} />
          </Space>
        </Form.Item>
      )}
    </Form.List>
  );
}
