import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { FormValues } from './schema';

/**
 * 已填过的自然人汇总池。
 * 参考旧版企业注册委托表单的「复用已填人员」逻辑：股东、法定代表人、董事、监事、
 * 财务负责人中出现过的自然人汇成一个列表，其它角色点选即可填入，避免同一个人重复录。
 * 按「姓名 + 证件号」去重；同一个人出现在多个角色时标签合并显示。
 */
export type NaturalPersonOption = {
  /** 来源标识（首次出现的来源），用于在某个角色块里把自身排除掉 */
  id: string;
  name: string;
  idNumber: string;
  mobile: string;
  /** 该自然人已填过的身份，如 ['自然人股东 1', '法定代表人'] */
  roles: string[];
};

/** 标签只写一次姓名，身份合并进括号：「张三（自然人股东 1 / 法定代表人）」 */
export const formatPersonLabel = (option: NaturalPersonOption) =>
  `${option.name || option.idNumber || '未命名'}（${option.roles.join(' / ')}）`;

/** 环节 8 的四个固定角色（人员信息采集与人员池共用一份定义） */
export const PERSON_ROLES = [
  { key: 'legalPerson', label: '法定代表人' },
  { key: 'director', label: '董事' },
  { key: 'supervisor', label: '监事' },
  { key: 'financeManager', label: '财务负责人' },
] as const;

type PersonLike = { name?: string; idNumber?: string; mobile?: string } | undefined;

export function useNaturalPersonOptions(): NaturalPersonOption[] {
  const { control } = useFormContext<FormValues>();
  const shareholders = useWatch({ control, name: 'shareholders' });
  const legalPerson = useWatch({ control, name: 'legalPerson' });
  const director = useWatch({ control, name: 'director' });
  const supervisor = useWatch({ control, name: 'supervisor' });
  const financeManager = useWatch({ control, name: 'financeManager' });

  return useMemo(() => {
    const options: NaturalPersonOption[] = [];
    const seen = new Map<string, number>();

    const upsert = (id: string, role: string, person: PersonLike) => {
      const name = person?.name ?? '';
      const idNumber = person?.idNumber ?? '';
      if (!name && !idNumber) return;
      const key = `${name}|||${idNumber}`;
      const existing = seen.get(key);
      if (existing !== undefined) {
        options[existing] = { ...options[existing], roles: [...options[existing].roles, role] };
        return;
      }
      seen.set(key, options.length);
      options.push({ id, name, idNumber, mobile: person?.mobile ?? '', roles: [role] });
    };

    (shareholders ?? []).forEach((item, index) => {
      if (item?.type !== '自然人') return;
      upsert(`shareholder-${index}`, `自然人股东 ${index + 1}`, item);
    });

    const rolePersons: Record<string, PersonLike> = {
      legalPerson,
      director,
      supervisor,
      financeManager,
    };
    PERSON_ROLES.forEach(({ key, label }) => {
      upsert(key, label, rolePersons[key]);
    });

    return options;
  }, [shareholders, legalPerson, director, supervisor, financeManager]);
}
