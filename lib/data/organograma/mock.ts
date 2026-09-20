// Small fixture mirroring the real `vw_hierarquia_rh` + `vw_hierarquia` shapes
// (see docs/hierarquia-permissionamento-referencia.md), for DATA_SOURCE=mock.
// Deliberately includes one dangling "grupo solto" (five promotores one path
// segment past the last node) and one stray individual, the same pattern the
// real warehouse has (the PAP - ARACAJU/SE 1 case: a líder node plus 11
// promotores sharing a non-node path).

import type { HierarquiaSnapshot, OrgNode, OrgPessoa } from "./types";

const NODES: OrgNode[] = [
  {
    path: "1",
    parentPath: null,
    nivel: "diretoria",
    nome: "DIRETORIA COMERCIAL",
    responsavelNome: "ANA DIRETORA",
    responsavelEmail: "ana.diretora@mock.com",
  },
  {
    path: "1.1",
    parentPath: "1",
    nivel: "gerencia_executiva",
    nome: "VENDAS - EXTERNAS B2C",
    responsavelNome: "BRUNO GERENTE",
    responsavelEmail: "bruno.gerente@mock.com",
  },
  {
    path: "1.1.1",
    parentPath: "1.1",
    nivel: "gerencia_funcional",
    nome: "COMERCIAL REGIONAL B2C 01",
    responsavelNome: "CARLA FUNCIONAL",
    responsavelEmail: "carla.funcional@mock.com",
  },
  {
    path: "1.1.1.1",
    parentPath: "1.1.1",
    nivel: "coordenacao",
    nome: "COORDENACAO CENTRO",
    responsavelNome: "DANIEL COORDENADOR",
    responsavelEmail: "daniel.coord@mock.com",
  },
  {
    path: "1.1.1.1.1",
    parentPath: "1.1.1.1",
    nivel: "supervisao",
    nome: "CIDADE - MOCKVILLE/CE",
    responsavelNome: "ELISA SUPERVISORA",
    responsavelEmail: "elisa.supervisora@mock.com",
  },
  {
    path: "1.1.1.1.1.1",
    parentPath: "1.1.1.1.1",
    nivel: "lideranca",
    nome: "LIDERANCA MOCKVILLE 1",
    responsavelNome: "FABIO LIDER",
    responsavelEmail: "fabio.lider@mock.com",
  },
];

const PESSOAS: OrgPessoa[] = [
  {
    cpf: "10000000001",
    nome: "ANA DIRETORA",
    cargo: "Diretora Comercial",
    email: "ana.diretora@mock.com",
    situacao: "ATIVO",
    path: "1",
  },
  {
    cpf: "10000000002",
    nome: "BRUNO GERENTE",
    cargo: "Gerente Executivo",
    email: "bruno.gerente@mock.com",
    situacao: "ATIVO",
    path: "1.1",
  },
  {
    cpf: "10000000003",
    nome: "CARLA FUNCIONAL",
    cargo: "Gerente Funcional",
    email: "carla.funcional@mock.com",
    situacao: "ATIVO",
    path: "1.1.1",
  },
  {
    cpf: "10000000004",
    nome: "DANIEL COORDENADOR",
    cargo: "Coordenador",
    email: "daniel.coord@mock.com",
    situacao: "ATIVO",
    path: "1.1.1.1",
  },
  {
    cpf: "10000000005",
    nome: "ELISA SUPERVISORA",
    cargo: "Supervisora de Vendas",
    email: "elisa.supervisora@mock.com",
    situacao: "ATIVO",
    path: "1.1.1.1.1",
  },
  {
    cpf: "10000000006",
    nome: "FABIO LIDER",
    cargo: "Líder Comercial de Vendas",
    email: "fabio.lider@mock.com",
    situacao: "ATIVO",
    path: "1.1.1.1.1.1",
  },
  // An assistant parked at the supervisora's own node path (not the responsável).
  {
    cpf: "10000000020",
    nome: "GABRIEL ASSISTENTE",
    cargo: "Assistente de Supervisão",
    email: "gabriel.assistente@mock.com",
    situacao: "ATIVO",
    path: "1.1.1.1.1",
  },
  // A stray individual one segment past the supervisão, matching no child node.
  {
    cpf: "10000000021",
    nome: "HELENA CONSULTORA",
    cargo: "Consultora Externa",
    email: "helena.consultora@mock.com",
    situacao: "FÉRIAS",
    path: "1.1.1.1.1.2",
  },
  // Five promotores sharing one path past the líder node — the PAP case.
  {
    cpf: "10000000010",
    nome: "PROMOTOR UM",
    cargo: "Promotor de Vendas",
    email: "promotor1@mock.com",
    situacao: "ATIVO",
    path: "1.1.1.1.1.1.1",
  },
  {
    cpf: "10000000011",
    nome: "PROMOTOR DOIS",
    cargo: "Promotor de Vendas",
    email: "promotor2@mock.com",
    situacao: "ATIVO",
    path: "1.1.1.1.1.1.1",
  },
  {
    cpf: "10000000012",
    nome: "PROMOTOR TRES",
    cargo: "Promotor de Vendas",
    email: "promotor3@mock.com",
    situacao: "ATIVO",
    path: "1.1.1.1.1.1.1",
  },
  {
    cpf: "10000000013",
    nome: "PROMOTOR QUATRO",
    cargo: "Promotor de Vendas",
    email: "promotor4@mock.com",
    situacao: "ATIVO",
    path: "1.1.1.1.1.1.1",
  },
  {
    cpf: "10000000014",
    nome: "PROMOTOR CINCO",
    cargo: "Promotor de Vendas",
    email: "promotor5@mock.com",
    situacao: "ATIVO",
    path: "1.1.1.1.1.1.1",
  },
];

export function mockHierarquiaSnapshot(): HierarquiaSnapshot {
  return { nodes: NODES, pessoas: PESSOAS, watermark: "mock:organograma:v1" };
}
